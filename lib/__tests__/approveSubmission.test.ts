import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveSubmission } from "@/lib/approveSubmission";

// What's under test is the copy-into-the-approved-bucket step, which has to
// survive a retry: an approval that failed after the copy was made leaves the
// file behind, and the retry must not treat that as a fatal error.

const download = vi.fn();
const upload = vi.fn();
const remove = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        download: (path: string) => download(bucket, path),
        upload: (path: string, file: unknown, options: unknown) => upload(bucket, path, file, options),
        remove: (paths: string[]) => remove(bucket, paths),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.test/${bucket}/${path}` },
        }),
      }),
    },
    rpc: (fn: string, args: unknown) => rpc(fn, args),
  },
}));

const submission = {
  id: "a2df8a14-0ba9-406d-b592-1ae0ef8d5972",
  kind: "photo_for_existing" as const,
  target_bobblehead_id: "community-padres-jake-peavy-224b82a9",
  team_slug: "padres",
  storage_path: "user-id/1d337546-24f6-431e-9322-f133e318422f.jpeg",
};

const approvedPath = `${submission.id}-1d337546-24f6-431e-9322-f133e318422f.jpeg`;

beforeEach(() => {
  download.mockReset().mockResolvedValue({ data: new Blob(["photo"]), error: null });
  upload.mockReset().mockResolvedValue({ error: null });
  remove.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ error: null });
});

describe("approveSubmission", () => {
  it("copies the photo into the approved bucket and records it", async () => {
    await approveSubmission(submission);

    expect(upload).toHaveBeenCalledWith("bobblehead-approved", approvedPath, expect.anything(), {
      upsert: false,
    });
    expect(rpc).toHaveBeenCalledWith("approve_submission", {
      p_submission_id: submission.id,
      p_image_url: `https://example.test/bobblehead-approved/${approvedPath}`,
      p_curated_has_photo: false,
    });
    expect(remove).toHaveBeenCalledWith("bobblehead-pending", [submission.storage_path]);
  });

  // The regression: a copy left behind by an earlier failed approval used to be
  // upserted over, which is an UPDATE on storage.objects — a statement the
  // approved bucket has no policy for, so the retry died with "new row violates
  // row-level security policy" and the submission could never leave the queue.
  it("reuses the copy an earlier failed approval left behind", async () => {
    upload.mockResolvedValue({
      error: { message: "The resource already exists", statusCode: "409" },
    });

    await expect(approveSubmission(submission)).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith(
      "approve_submission",
      expect.objectContaining({ p_image_url: `https://example.test/bobblehead-approved/${approvedPath}` }),
    );
  });

  it("still fails on an upload error that isn't a duplicate", async () => {
    upload.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });

    await expect(approveSubmission(submission)).rejects.toThrow(/row-level security/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("removes its copy when the approval itself fails", async () => {
    rpc.mockResolvedValue({ error: { message: "not authorized" } });

    await expect(approveSubmission(submission)).rejects.toThrow("not authorized");
    expect(remove).toHaveBeenCalledWith("bobblehead-approved", [approvedPath]);
    expect(remove).not.toHaveBeenCalledWith("bobblehead-pending", [submission.storage_path]);
  });
});
