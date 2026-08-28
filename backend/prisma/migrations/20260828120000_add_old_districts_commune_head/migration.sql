-- Adds the 4th officer role tier (commune_head = "trưởng xã") and the old-ward (63) boundary
-- data + old->new spatial overlap mapping needed for trưởng xã to sub-assign địa bàn cũ to
-- cấp dưới accounts. See docs/adr and CLAUDE.md "Khi bắt đầu code, thứ tự ưu tiên" #4.

-- AlterEnum
ALTER TYPE "officer_role" ADD VALUE 'commune_head';

-- CreateTable
CREATE TABLE "old_districts" (
    "id" TEXT NOT NULL,
    "ma_tinh" TEXT NOT NULL,
    "ma_xa" TEXT NOT NULL,
    "ten_xa" TEXT NOT NULL,
    "ma_huyen" TEXT,
    "ten_huyen" TEXT,
    "ten_tinh" TEXT,
    "loai" TEXT,
    "boundary" geometry(MultiPolygon,4326) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "old_districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "old_district_overlaps" (
    "id" TEXT NOT NULL,
    "old_district_id" TEXT NOT NULL,
    "district_id" TEXT NOT NULL,
    "overlap_area_km2" DOUBLE PRECISION NOT NULL,
    "overlap_ratio" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "old_district_overlaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "old_districts_ma_tinh_ma_xa_key" ON "old_districts"("ma_tinh", "ma_xa");

-- CreateIndex
CREATE UNIQUE INDEX "old_district_overlaps_old_district_id_district_id_key" ON "old_district_overlaps"("old_district_id", "district_id");

-- CreateIndex
CREATE INDEX "old_district_overlaps_district_id_idx" ON "old_district_overlaps"("district_id");

-- AddForeignKey
ALTER TABLE "old_district_overlaps" ADD CONSTRAINT "old_district_overlaps_old_district_id_fkey" FOREIGN KEY ("old_district_id") REFERENCES "old_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "old_district_overlaps" ADD CONSTRAINT "old_district_overlaps_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: officer_district_assignments gains nullable oldDistrictId + widened unique key
ALTER TABLE "officer_district_assignments" ADD COLUMN "old_district_id" TEXT;

DROP INDEX "officer_district_assignments_officer_id_district_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "officer_district_assignments_officer_id_district_id_old_d_key" ON "officer_district_assignments"("officer_id", "district_id", "old_district_id");

-- AddForeignKey
ALTER TABLE "officer_district_assignments" ADD CONSTRAINT "officer_district_assignments_old_district_id_fkey" FOREIGN KEY ("old_district_id") REFERENCES "old_districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
