-- CreateEnum
CREATE TYPE "traffic_accident_alert_status" AS ENUM ('pending', 'confirmed', 'dismissed');

-- CreateTable
CREATE TABLE "traffic_accident_alerts" (
    "id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "district_id" TEXT,
    "assigned_officer_id" TEXT,
    "plate_numbers" TEXT,
    "thumbnail_url" TEXT,
    "status" "traffic_accident_alert_status" NOT NULL DEFAULT 'pending',
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by_officer_id" TEXT,

    CONSTRAINT "traffic_accident_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traffic_accident_alerts_district_id_idx" ON "traffic_accident_alerts"("district_id");

-- AddForeignKey
ALTER TABLE "traffic_accident_alerts" ADD CONSTRAINT "traffic_accident_alerts_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traffic_accident_alerts" ADD CONSTRAINT "traffic_accident_alerts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traffic_accident_alerts" ADD CONSTRAINT "traffic_accident_alerts_assigned_officer_id_fkey" FOREIGN KEY ("assigned_officer_id") REFERENCES "officers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traffic_accident_alerts" ADD CONSTRAINT "traffic_accident_alerts_confirmed_by_officer_id_fkey" FOREIGN KEY ("confirmed_by_officer_id") REFERENCES "officers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
