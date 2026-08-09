-- Camera viewing direction (compass bearing 0-359) + field-of-view width in degrees, so the
-- officer UI can draw a "cone" showing what a camera actually sees instead of a plain dot.
-- Nullable: existing/real cameras registered without this data keep showing as a plain marker.
ALTER TABLE "cameras" ADD COLUMN "direction_degrees" INTEGER;
ALTER TABLE "cameras" ADD COLUMN "fov_degrees" INTEGER;
