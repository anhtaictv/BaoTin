-- CreateEnum
CREATE TYPE "report_source" AS ENUM ('citizen', 'social_media');

-- CreateEnum
CREATE TYPE "report_urgency" AS ENUM ('emergency', 'normal');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('pending', 'verifying', 'confirmed_true', 'confirmed_false');

-- CreateEnum
CREATE TYPE "trust_level" AS ENUM ('verified_press', 'unverified_social');

-- CreateEnum
CREATE TYPE "officer_role" AS ENUM ('officer', 'senior_officer', 'admin');

-- CreateEnum
CREATE TYPE "extraction_request_status" AS ENUM ('pending', 'sent', 'fulfilled', 'rejected');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone_number_enc" TEXT NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "full_name_enc" TEXT,
    "verified_at" TIMESTAMP(3),
    "is_anonymous_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "officers" (
    "id" TEXT NOT NULL,
    "phone_number_enc" TEXT NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "full_name_enc" TEXT NOT NULL,
    "unit_name" TEXT,
    "role" "officer_role" NOT NULL DEFAULT 'officer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "officers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wanted_notices" (
    "id" TEXT NOT NULL,
    "photo_url" TEXT NOT NULL,
    "posted_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wanted_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_accounts" (
    "id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "web_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "ma_xa" TEXT,
    "ten_xa" TEXT NOT NULL,
    "parent_name" TEXT,
    "loai" TEXT,
    "dtich_km2" DOUBLE PRECISION,
    "dan_so" INTEGER,
    "boundary" geometry(MultiPolygon,4326) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "district_id" TEXT,
    "contact_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "officer_district_assignments" (
    "id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "district_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "officer_district_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "source" "report_source" NOT NULL DEFAULT 'citizen',
    "user_id" TEXT,
    "category" TEXT,
    "urgency" "report_urgency" NOT NULL DEFAULT 'normal',
    "description" TEXT,
    "voice_note_url" TEXT,
    "location" geometry(Point,4326) NOT NULL,
    "location_source" TEXT,
    "district_id" TEXT,
    "assigned_officer_id" TEXT,
    "status" "report_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),
    "response_time_seconds" INTEGER,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_attachments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT,
    "exif_gps_lat" DOUBLE PRECISION,
    "exif_gps_lng" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media_signals" (
    "id" TEXT NOT NULL,
    "source_name" TEXT,
    "source_url" TEXT,
    "trust_level" "trust_level" NOT NULL,
    "summary" TEXT,
    "raw_snippet" TEXT,
    "district_id" TEXT,
    "detected_category" TEXT,
    "published_at" TIMESTAMP(3),
    "crawled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duplicate_of" TEXT,

    CONSTRAINT "social_media_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_status_history" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "old_status" "report_status",
    "new_status" "report_status" NOT NULL,
    "changed_by" TEXT,
    "note" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "official_case_links" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "external_case_id" TEXT,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_case_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "user_id" TEXT,
    "officer_id" TEXT,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "user_id" TEXT,
    "officer_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cameras" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" geometry(Point,4326) NOT NULL,
    "managing_unit_name" TEXT,
    "managing_unit_contact" TEXT,
    "district_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_extraction_requests" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "time_range_start" TIMESTAMP(3) NOT NULL,
    "time_range_end" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "group_id" TEXT,
    "status" "extraction_request_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camera_extraction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_hash_key" ON "users"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "officers_phone_hash_key" ON "officers"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "web_accounts_officer_id_key" ON "web_accounts"("officer_id");

-- CreateIndex
CREATE UNIQUE INDEX "web_accounts_username_key" ON "web_accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "districts_ma_xa_key" ON "districts"("ma_xa");

-- CreateIndex
CREATE INDEX "emergency_contacts_district_id_contact_type_idx" ON "emergency_contacts"("district_id", "contact_type");

-- CreateIndex
CREATE INDEX "officer_district_assignments_district_id_is_active_idx" ON "officer_district_assignments"("district_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "officer_district_assignments_officer_id_district_id_key" ON "officer_district_assignments"("officer_id", "district_id");

-- CreateIndex
CREATE INDEX "reports_district_id_idx" ON "reports"("district_id");

-- CreateIndex
CREATE INDEX "otp_challenges_user_id_expires_at_idx" ON "otp_challenges"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "otp_challenges_officer_id_expires_at_idx" ON "otp_challenges"("officer_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "camera_extraction_requests_report_id_idx" ON "camera_extraction_requests"("report_id");

-- CreateIndex
CREATE INDEX "camera_extraction_requests_group_id_idx" ON "camera_extraction_requests"("group_id");

-- AddForeignKey
ALTER TABLE "wanted_notices" ADD CONSTRAINT "wanted_notices_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_accounts" ADD CONSTRAINT "web_accounts_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer_district_assignments" ADD CONSTRAINT "officer_district_assignments_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer_district_assignments" ADD CONSTRAINT "officer_district_assignments_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_officer_id_fkey" FOREIGN KEY ("assigned_officer_id") REFERENCES "officers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_signals" ADD CONSTRAINT "social_media_signals_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_signals" ADD CONSTRAINT "social_media_signals_duplicate_of_fkey" FOREIGN KEY ("duplicate_of") REFERENCES "social_media_signals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "officers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "official_case_links" ADD CONSTRAINT "official_case_links_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_extraction_requests" ADD CONSTRAINT "camera_extraction_requests_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_extraction_requests" ADD CONSTRAINT "camera_extraction_requests_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_extraction_requests" ADD CONSTRAINT "camera_extraction_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

