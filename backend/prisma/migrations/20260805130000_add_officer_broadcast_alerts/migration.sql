-- Geo-fence alert (broadcast theo địa bàn) — officer/senior_officer/admin phát cảnh báo nhanh
-- tới người dân trong 1 địa bàn cụ thể. See backend/src/services/broadcastAlerts.service.ts.

-- CreateTable
CREATE TABLE "officer_broadcast_alerts" (
    "id" TEXT NOT NULL,
    "district_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "urgency" "report_urgency" NOT NULL DEFAULT 'normal',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "officer_broadcast_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "officer_broadcast_alerts_district_id_created_at_idx" ON "officer_broadcast_alerts"("district_id", "created_at");

-- AddForeignKey
ALTER TABLE "officer_broadcast_alerts" ADD CONSTRAINT "officer_broadcast_alerts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer_broadcast_alerts" ADD CONSTRAINT "officer_broadcast_alerts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
