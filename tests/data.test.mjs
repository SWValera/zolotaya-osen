import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { objects, statuses, mapConfig } from "../public/assets/js/objects.js";
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
assert.ok(objects.length >= 22);
assert.ok(objects.filter((o) => o.type === "house").length >= 10);
assert.ok(objects.filter((o) => o.type === "bath").length >= 2);
assert.ok(objects.filter((o) => o.type === "gazebo").length >= 3);
assert.equal(new Set(objects.map((o) => o.id)).size, objects.length);
assert.equal(new Set(objects.map((o) => o.mapAreaId)).size, objects.length);
for (const object of objects) {
  for (const field of [
    "id",
    "name",
    "type",
    "description",
    "price",
    "capacity",
    "beds",
    "amenities",
    "photos",
    "status",
    "mapAreaId",
  ])
    assert.ok(field in object, `${object.id}: ${field}`);
  assert.ok(statuses[object.status]);
  assert.ok(Array.isArray(object.photos));
  for (const photo of object.photos) {
    const src = typeof photo === "string" ? photo : photo.src;
    if (src.startsWith("./")) {
      const localPath = src.slice(2).split("?")[0];
      assert.ok(
        existsSync(path.join(publicRoot, localPath)),
        `${object.id}: missing photo ${src}`,
      );
    }
  }
  if (object.points)
    for (const point of object.points.split(" ")) {
      const [x, y] = point.split(",").map(Number);
      assert.ok(
        x >= 0 && x <= mapConfig.width && y >= 0 && y <= mapConfig.height,
        object.id,
      );
    }
}
console.log(
  "PASS: data schema, unique objects, statuses and coordinate bounds.",
);
