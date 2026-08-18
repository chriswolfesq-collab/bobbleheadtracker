export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      approved_photos: {
        Row: {
          approved_by: string | null
          bobblehead_id: string
          image_url: string
          team_slug: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          bobblehead_id: string
          image_url: string
          team_slug: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          bobblehead_id?: string
          image_url?: string
          team_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      bobblehead_gallery_photos: {
        Row: {
          approved_by: string | null
          bobblehead_id: string
          created_at: string
          id: string
          image_url: string
          team_slug: string
        }
        Insert: {
          approved_by?: string | null
          bobblehead_id: string
          created_at?: string
          id?: string
          image_url: string
          team_slug: string
        }
        Update: {
          approved_by?: string | null
          bobblehead_id?: string
          created_at?: string
          id?: string
          image_url?: string
          team_slug?: string
        }
        Relationships: []
      }
      bobblehead_overrides: {
        Row: {
          bobblehead_id: string
          city: string | null
          description: string | null
          date: string | null
          deleted: boolean
          nickname: string | null
          photo_hidden: boolean
          quantity: string | null
          rarity: string | null
          rarity_note: string | null
          team_slug: string
          title: string | null
          updated_at: string
          updated_by: string | null
          year: string | null
        }
        Insert: {
          bobblehead_id: string
          city?: string | null
          description?: string | null
          date?: string | null
          deleted?: boolean
          nickname?: string | null
          photo_hidden?: boolean
          quantity?: string | null
          rarity?: string | null
          rarity_note?: string | null
          team_slug: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          year?: string | null
        }
        Update: {
          bobblehead_id?: string
          city?: string | null
          description?: string | null
          date?: string | null
          deleted?: boolean
          nickname?: string | null
          photo_hidden?: boolean
          quantity?: string | null
          rarity?: string | null
          rarity_note?: string | null
          team_slug?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          year?: string | null
        }
        Relationships: []
      }
      community_bobbleheads: {
        Row: {
          approved_by: string | null
          city: string | null
          description: string | null
          created_at: string
          date: string
          id: string
          image_url: string | null
          nickname: string | null
          quantity: string | null
          rarity: string | null
          rarity_note: string | null
          team_slug: string
          title: string
          year: string
        }
        Insert: {
          approved_by?: string | null
          city?: string | null
          description?: string | null
          created_at?: string
          date?: string
          id: string
          image_url?: string | null
          nickname?: string | null
          quantity?: string | null
          rarity?: string | null
          rarity_note?: string | null
          team_slug: string
          title: string
          year?: string
        }
        Update: {
          approved_by?: string | null
          city?: string | null
          description?: string | null
          created_at?: string
          date?: string
          id?: string
          image_url?: string | null
          nickname?: string | null
          quantity?: string | null
          rarity?: string | null
          rarity_note?: string | null
          team_slug?: string
          title?: string
          year?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chat_reads: {
        Row: {
          read_at: string
          user_id: string
        }
        Insert: {
          read_at?: string
          user_id: string
        }
        Update: {
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dead_images: {
        Row: {
          bobblehead_id: string
          error: string | null
          first_seen_at: string
          http_status: number | null
          id: string
          image_url: string
          last_checked_at: string
          listing_kind: string
          resolved_at: string | null
          source: string
          status: string
          team_slug: string
          title: string | null
        }
        Insert: {
          bobblehead_id: string
          error?: string | null
          first_seen_at?: string
          http_status?: number | null
          id?: string
          image_url: string
          last_checked_at?: string
          listing_kind: string
          resolved_at?: string | null
          source: string
          status?: string
          team_slug: string
          title?: string | null
        }
        Update: {
          bobblehead_id?: string
          error?: string | null
          first_seen_at?: string
          http_status?: number | null
          id?: string
          image_url?: string
          last_checked_at?: string
          listing_kind?: string
          resolved_at?: string | null
          source?: string
          status?: string
          team_slug?: string
          title?: string | null
        }
        Relationships: []
      }
      description_edit_requests: {
        Row: {
          bobblehead_id: string
          created_at: string
          id: string
          proposed: string
          requested_by: string
          reviewed_at: string | null
          source: string
          status: string
          team_slug: string
        }
        Insert: {
          bobblehead_id: string
          created_at?: string
          id?: string
          proposed: string
          requested_by: string
          reviewed_at?: string | null
          source?: string
          status?: string
          team_slug: string
        }
        Update: {
          bobblehead_id?: string
          created_at?: string
          id?: string
          proposed?: string
          requested_by?: string
          reviewed_at?: string | null
          source?: string
          status?: string
          team_slug?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      forum_reads: {
        Row: {
          read_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          read_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          read_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_reads_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          author_email: string | null
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          edited_at: string | null
          id: string
          image_path: string | null
          topic_id: string
        }
        Insert: {
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          image_path?: string | null
          topic_id: string
        }
        Update: {
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          image_path?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_topics: {
        Row: {
          author_email: string | null
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          edited_at: string | null
          id: string
          image_path: string | null
          last_activity_at: string
          locked: boolean
          pinned: boolean
          reply_count: number
          team_slug: string | null
          title: string
        }
        Insert: {
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          image_path?: string | null
          last_activity_at?: string
          locked?: boolean
          pinned?: boolean
          reply_count?: number
          team_slug?: string | null
          title: string
        }
        Update: {
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          image_path?: string | null
          last_activity_at?: string
          locked?: boolean
          pinned?: boolean
          reply_count?: number
          team_slug?: string | null
          title?: string
        }
        Relationships: []
      }
      listing_reports: {
        Row: {
          bobblehead_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reviewed_at: string | null
          source: string
          status: string
          submitted_by: string
          team_slug: string
          title: string
        }
        Insert: {
          bobblehead_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reviewed_at?: string | null
          source: string
          status?: string
          submitted_by: string
          team_slug: string
          title: string
        }
        Update: {
          bobblehead_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reviewed_at?: string | null
          source?: string
          status?: string
          submitted_by?: string
          team_slug?: string
          title?: string
        }
        Relationships: []
      }
      photo_votes: {
        Row: {
          bobblehead_id: string
          image_url: string
          team_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bobblehead_id: string
          image_url: string
          team_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bobblehead_id?: string
          image_url?: string
          team_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          email_enabled: boolean
          accepts_messages: boolean
          email_forum_digest: boolean
          email_messages: boolean
          email_rep_digest: boolean
          email_weekly_digest: boolean
          email_submission_updates: boolean
          email_wishlist_alerts: boolean
          gallery_public: boolean
          friends_see_items: boolean
          listed_in_search: boolean
          id: string
          is_public: boolean
          awards_intro_ack_at: string | null
          member_number: number | null
          referral_code: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          email_enabled?: boolean
          accepts_messages?: boolean
          email_forum_digest?: boolean
          email_messages?: boolean
          email_rep_digest?: boolean
          email_weekly_digest?: boolean
          email_submission_updates?: boolean
          email_wishlist_alerts?: boolean
          gallery_public?: boolean
          friends_see_items?: boolean
          listed_in_search?: boolean
          id: string
          is_public?: boolean
          awards_intro_ack_at?: string | null
          member_number?: number | null
          referral_code?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          email_enabled?: boolean
          accepts_messages?: boolean
          email_forum_digest?: boolean
          email_messages?: boolean
          email_rep_digest?: boolean
          email_weekly_digest?: boolean
          email_submission_updates?: boolean
          email_wishlist_alerts?: boolean
          gallery_public?: boolean
          friends_see_items?: boolean
          listed_in_search?: boolean
          id?: string
          is_public?: boolean
          awards_intro_ack_at?: string | null
          member_number?: number | null
          referral_code?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: []
      }
      rep_activity: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          bobblehead_id: string | null
          created_at: string
          detail: string | null
          id: number
          team_slug: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          bobblehead_id?: string | null
          created_at?: string
          detail?: string | null
          id?: never
          team_slug?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          bobblehead_id?: string | null
          created_at?: string
          detail?: string | null
          id?: never
          team_slug?: string | null
        }
        Relationships: []
      }
      inbound_messages: {
        Row: {
          created_at: string
          email: string
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: string
          message: string
          name: string | null
          status: string
          submitted_by: string | null
          team_slug: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind: string
          message: string
          name?: string | null
          status?: string
          submitted_by?: string | null
          team_slug?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: string
          message?: string
          name?: string | null
          status?: string
          submitted_by?: string | null
          team_slug?: string | null
        }
        Relationships: []
      }
      inbound_message_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          message_id: string
          sent_by: string | null
          sent_to: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          message_id: string
          sent_by?: string | null
          sent_to: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          message_id?: string
          sent_by?: string | null
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_message_replies_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "inbound_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_message_at: string
          member_id: string | null
          pair_key: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          last_message_at?: string
          member_id?: string | null
          pair_key?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          member_id?: string | null
          pair_key?: string | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          notified_at: string | null
          read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          notified_at?: string | null
          read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          notified_at?: string | null
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string | null
          sender_name: string | null
          sender_role: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_name?: string | null
          sender_role: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_name?: string | null
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      scraped_giveaways: {
        Row: {
          approved_community_id: string | null
          date: string
          dedupe_key: string
          detected_text: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          reviewed_at: string | null
          source_url: string
          status: string
          team_slug: string
          title: string
          year: string
        }
        Insert: {
          approved_community_id?: string | null
          date: string
          dedupe_key: string
          detected_text?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          reviewed_at?: string | null
          source_url: string
          status?: string
          team_slug: string
          title: string
          year: string
        }
        Update: {
          approved_community_id?: string | null
          date?: string
          dedupe_key?: string
          detected_text?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          reviewed_at?: string | null
          source_url?: string
          status?: string
          team_slug?: string
          title?: string
          year?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          created_at: string
          date: string | null
          id: string
          kind: string
          nickname: string | null
          quantity: string | null
          reviewed_at: string | null
          status: string
          storage_path: string | null
          submitted_by: string
          target_bobblehead_id: string | null
          team_slug: string
          title: string | null
          year: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          id?: string
          kind: string
          nickname?: string | null
          quantity?: string | null
          reviewed_at?: string | null
          status?: string
          storage_path?: string | null
          submitted_by: string
          target_bobblehead_id?: string | null
          team_slug: string
          title?: string | null
          year?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          id?: string
          kind?: string
          nickname?: string | null
          quantity?: string | null
          reviewed_at?: string | null
          status?: string
          storage_path?: string | null
          submitted_by?: string
          target_bobblehead_id?: string | null
          team_slug?: string
          title?: string | null
          year?: string | null
        }
        Relationships: []
      }
      team_reps: {
        Row: {
          created_at: string
          email: string
          team_slug: string
        }
        Insert: {
          created_at?: string
          email: string
          team_slug: string
        }
        Update: {
          created_at?: string
          email?: string
          team_slug?: string
        }
        Relationships: []
      }
      user_collections: {
        Row: {
          acquired_on: string | null
          added_at: string | null
          bobblehead_id: string
          condition: string | null
          notes: string | null
          owned: boolean
          price_paid: number | null
          team_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acquired_on?: string | null
          added_at?: string | null
          bobblehead_id: string
          condition?: string | null
          notes?: string | null
          owned?: boolean
          price_paid?: number | null
          team_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acquired_on?: string | null
          added_at?: string | null
          bobblehead_id?: string
          condition?: string | null
          notes?: string | null
          owned?: boolean
          price_paid?: number | null
          team_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          bobblehead_id: string
          favorited: boolean
          team_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bobblehead_id: string
          favorited?: boolean
          team_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bobblehead_id?: string
          favorited?: boolean
          team_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_wants: {
        Row: {
          bobblehead_id: string
          team_slug: string
          updated_at: string
          user_id: string
          wanted: boolean
        }
        Insert: {
          bobblehead_id: string
          team_slug: string
          updated_at?: string
          user_id: string
          wanted?: boolean
        }
        Update: {
          bobblehead_id?: string
          team_slug?: string
          updated_at?: string
          user_id?: string
          wanted?: boolean
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          created_by: string | null
          label: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          label: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          label?: string
          slug?: string
        }
        Relationships: []
      }
      bobblehead_tags: {
        Row: {
          bobblehead_id: string
          created_at: string
          created_by: string | null
          tag_slug: string
          team_slug: string
        }
        Insert: {
          bobblehead_id: string
          created_at?: string
          created_by?: string | null
          tag_slug: string
          team_slug: string
        }
        Update: {
          bobblehead_id?: string
          created_at?: string
          created_by?: string | null
          tag_slug?: string
          team_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "bobblehead_tags_tag_slug_fkey"
            columns: ["tag_slug"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["slug"]
          },
        ]
      }
      tag_requests: {
        Row: {
          bobblehead_id: string
          created_at: string
          id: string
          label: string
          requested_by: string
          reviewed_at: string | null
          slug: string
          source: string
          status: string
          team_slug: string
        }
        Insert: {
          bobblehead_id: string
          created_at?: string
          id?: string
          label: string
          requested_by: string
          reviewed_at?: string | null
          slug: string
          source?: string
          status?: string
          team_slug: string
        }
        Update: {
          bobblehead_id?: string
          created_at?: string
          id?: string
          label?: string
          requested_by?: string
          reviewed_at?: string | null
          slug?: string
          source?: string
          status?: string
          team_slug?: string
        }
        Relationships: []
      }
      wishlist_alerts_sent: {
        Row: {
          bobblehead_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          bobblehead_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          bobblehead_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      tag_counts: {
        Row: {
          label: string | null
          listing_count: number | null
          slug: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_assign_team_rep: {
        Args: { p_email: string; p_team_slug: string }
        Returns: undefined
      }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_delete_bobblehead: {
        Args: { p_bobblehead_id: string; p_source: string; p_team_slug: string }
        Returns: undefined
      }
      admin_delete_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_get_user: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          last_sign_in_at: string
        }[]
      }
      admin_list_inbound_messages: {
        Args: { p_kind?: string | null }
        Returns: (Database["public"]["Tables"]["inbound_messages"]["Row"] & {
          replies: Json
        })[]
      }
      admin_record_inbound_reply: {
        Args: { p_body: string; p_message_id: string }
        Returns: string
      }
      admin_list_conversations: {
        Args: never
        Returns: {
          conversation_id: string
          last_message_at: string
          last_message_preview: string | null
          last_sender_role: string | null
          member_avatar_path: string | null
          member_email: string | null
          member_id: string | null
          member_name: string | null
          member_slug: string | null
          message_count: number
          unread_count: number
        }[]
      }
      admin_unread_conversation_count: {
        Args: never
        Returns: number
      }
      can_read_conversation: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      can_start_direct: {
        Args: { p_target_id: string }
        Returns: boolean
      }
      conversation_list_messages: {
        Args: { p_before?: string | null; p_conversation_id: string }
        Returns: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_avatar_path: string | null
          sender_id: string | null
          sender_name: string | null
          sender_role: string
        }[]
      }
      conversation_mark_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      conversation_new_messages: {
        Args: { p_conversation_id: string; p_since: string }
        Returns: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_avatar_path: string | null
          sender_id: string | null
          sender_name: string | null
          sender_role: string
        }[]
      }
      conversation_send: {
        Args: { p_body: string; p_conversation_id: string }
        Returns: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_avatar_path: string | null
          sender_id: string | null
          sender_name: string | null
          sender_role: string
        }[]
      }
      inbox_list: {
        Args: never
        Returns: {
          conversation_id: string
          kind: string
          last_message_at: string
          last_message_preview: string | null
          last_sender_role: string | null
          other_avatar_path: string | null
          other_slug: string | null
          title: string
          unread_count: number
        }[]
      }
      inbox_unread_count: {
        Args: never
        Returns: number
      }
      block_member: {
        Args: { p_slug: string }
        Returns: undefined
      }
      direct_pair_key: {
        Args: { p_a: string; p_b: string }
        Returns: string
      }
      list_message_blocks: {
        Args: never
        Returns: {
          avatar_path: string | null
          created_at: string
          display_name: string | null
          slug: string
        }[]
      }
      message_admin: {
        Args: { p_body: string }
        Returns: string
      }
      start_direct_conversation: {
        Args: { p_body: string; p_slug: string }
        Returns: string
      }
      unblock_member: {
        Args: { p_slug: string }
        Returns: undefined
      }
      set_accepts_messages: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      admin_list_team_reps: {
        Args: never
        Returns: {
          created_at: string
          email: string
          team_slug: string
        }[]
      }
      admin_mark_message_handled: {
        Args: { p_id: string; p_handled?: boolean }
        Returns: undefined
      }
      admin_delete_inbound_message: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          favorite_count: number
          id: string
          last_sign_in_at: string
          owned_count: number
          report_count: number
          submission_count: number
          wanted_count: number
        }[]
      }
      admin_remove_team_rep: {
        Args: { p_email: string; p_team_slug: string }
        Returns: undefined
      }
      admin_update_display_name: {
        Args: { p_display_name: string; p_user_id: string }
        Returns: undefined
      }
      approve_scraped_giveaway: { Args: { p_id: string }; Returns: string }
      approve_submission: {
        Args: {
          p_curated_has_photo?: boolean
          p_image_url: string
          p_submission_id: string
        }
        Returns: undefined
      }
      can_edit_team: { Args: { p_team_slug: string }; Returns: boolean }
      display_name_of: { Args: { p_meta: Json }; Returns: string }
      enable_public_shelf: { Args: never; Returns: string }
      forum_author: {
        Args: never
        Returns: {
          email: string
          name: string
          user_id: string
        }[]
      }
      forum_create_topic: {
        Args: {
          p_body: string
          p_image_path?: string
          p_team_slug?: string
          p_title: string
        }
        Returns: string
      }
      forum_delete_reply: { Args: { p_id: string }; Returns: string[] }
      forum_delete_topic: { Args: { p_id: string }; Returns: string[] }
      forum_edit_reply: {
        Args: { p_body: string; p_id: string }
        Returns: undefined
      }
      forum_edit_topic: {
        Args: { p_body: string; p_id: string; p_title: string }
        Returns: undefined
      }
      forum_get_topic: {
        Args: { p_id: string }
        Returns: {
          author_avatar_path: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          edited_at: string
          id: string
          image_path: string
          last_activity_at: string
          locked: boolean
          pinned: boolean
          reply_count: number
          team_slug: string
          title: string
        }[]
      }
      forum_list_replies: {
        Args: { p_topic_id: string }
        Returns: {
          author_avatar_path: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          edited_at: string
          id: string
          image_path: string
          topic_id: string
        }[]
      }
      forum_list_topics: {
        Args: never
        Returns: {
          author_avatar_path: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          edited_at: string
          id: string
          image_path: string
          last_activity_at: string
          locked: boolean
          pinned: boolean
          reply_count: number
          team_slug: string
          title: string
          unread: boolean
        }[]
      }
      forum_mark_read: { Args: { p_topic_id: string }; Returns: undefined }
      forum_reply: {
        Args: { p_body: string; p_image_path?: string; p_topic_id: string }
        Returns: string
      }
      forum_set_locked: {
        Args: { p_id: string; p_locked: boolean }
        Returns: undefined
      }
      forum_set_pinned: {
        Args: { p_id: string; p_pinned: boolean }
        Returns: undefined
      }
      forum_unread_count: { Args: never; Returns: number }
      chat_list_messages: {
        Args: { p_before?: string }
        Returns: {
          author_avatar_path: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
        }[]
      }
      chat_new_messages: {
        Args: { p_since: string }
        Returns: {
          author_avatar_path: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
        }[]
      }
      chat_send: {
        Args: { p_body: string }
        Returns: {
          author_avatar_path: string
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
        }[]
      }
      chat_delete_message: { Args: { p_id: string }; Returns: undefined }
      chat_mark_read: { Args: never; Returns: undefined }
      chat_unread_count: { Args: never; Returns: number }
      cancel_friend_request: { Args: { p_addressee: string }; Returns: undefined }
      friend_shelf_status: {
        Args: { p_slug: string }
        Returns: {
          owner_id: string
          owner_shares_with_friends: boolean
          status: string
        }[]
      }
      get_friend_gallery: {
        Args: { p_slug: string }
        Returns: {
          bobblehead_id: string
          kind: string
          team_slug: string
        }[]
      }
      list_friendships: {
        Args: never
        Returns: {
          avatar_path: string
          created_at: string
          direction: string
          display_name: string
          is_public: boolean
          slug: string
          status: string
          user_id: string
        }[]
      }
      remove_friend: { Args: { p_user_id: string }; Returns: undefined }
      respond_friend_request: {
        Args: { p_accept: boolean; p_requester: string }
        Returns: undefined
      }
      send_friend_request: { Args: { p_slug: string }; Returns: string }
      search_members: {
        Args: { p_query: string }
        Returns: {
          avatar_path: string | null
          display_name: string
          slug: string
          status: string
          user_id: string
        }[]
      }
      get_public_gallery: {
        Args: { p_slug: string }
        Returns: {
          bobblehead_id: string
          kind: string
          team_slug: string
        }[]
      }
      get_public_shelf: {
        Args: { p_slug: string }
        Returns: {
          counts: Json
          display_name: string
          member_number: number | null
          rep_teams: string[]
          approved_submissions: number
          qualifying_referrals: number
          collecting_months: string[]
        }[]
      }
      my_award_activity: {
        Args: never
        Returns: {
          approved_submissions: number
          qualifying_referrals: number
          months: string[]
        }[]
      }
      my_rep_teams: { Args: never; Returns: string[] }
      ack_awards_intro: { Args: never; Returns: undefined }
      admin_referral_leaderboard: { Args: never; Returns: Json }
      admin_referral_stats: { Args: never; Returns: Json }
      claim_referral: { Args: { p_code: string }; Returns: string }
      cast_photo_vote: {
        Args: { p_bobblehead_id: string; p_image_url: string; p_team_slug: string }
        Returns: undefined
      }
      get_photo_votes: {
        Args: { p_bobblehead_id: string; p_team_slug: string }
        Returns: {
          image_url: string
          my_vote: boolean
          votes: number
        }[]
      }
      promote_top_photo: {
        Args: { p_bobblehead_id: string; p_team_slug: string }
        Returns: undefined
      }
      retract_photo_vote: {
        Args: { p_bobblehead_id: string; p_team_slug: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_moderator: { Args: never; Returns: boolean }
      is_team_rep: { Args: never; Returns: boolean }
      my_editable_teams: { Args: never; Returns: string[] }
      my_referral: {
        Args: never
        Returns: {
          code: string
          joined: number
          qualified: number
        }[]
      }
      referral_qualifying_owned: { Args: never; Returns: number }
      reject_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      send_forum_digest: { Args: { p_hours?: number }; Returns: number }
      set_friends_see_items: { Args: { p_enabled: boolean }; Returns: undefined }
      set_listed_in_search: { Args: { p_enabled: boolean }; Returns: undefined }
      set_gallery_public: { Args: { p_enabled: boolean }; Returns: undefined }
      send_rep_activity_digest: { Args: { p_hours?: number }; Returns: number }
      set_email_preference: {
        Args: { p_kind: string; p_enabled: boolean }
        Returns: undefined
      }
      set_wishlist_alerts: { Args: { p_enabled: boolean }; Returns: undefined }
      wants_email: { Args: { p_user_id: string; p_kind: string }; Returns: boolean }
      wants_email_by_address: {
        Args: { p_email: string; p_kind: string }
        Returns: boolean
      }
      slugify: { Args: { p_text: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
