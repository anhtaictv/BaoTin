-- CreateEnum
CREATE TYPE "officer_approval_status" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "officers" ADD COLUMN     "address_enc" TEXT,
ADD COLUMN     "approval_status" "officer_approval_status" NOT NULL DEFAULT 'approved',
ADD COLUMN     "cccd_number_enc" TEXT,
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address_enc" TEXT,
ADD COLUMN     "cccd_back_photo_url" TEXT,
ADD COLUMN     "cccd_front_photo_url" TEXT,
ADD COLUMN     "cccd_number_enc" TEXT,
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "officers_username_key" ON "officers"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

