import { access, mkdir, writeFile } from "node:fs/promises";
import { randomBytes, pbkdf2Sync } from "node:crypto";
import { dirname, resolve } from "node:path";

const passwordFile = resolve(".private/Золотая-осень-админ.txt");
const hashFile = resolve(".private/admin-password-hash.txt");
for (const path of [passwordFile, hashFile]) {
  try { await access(path); throw new Error("Пароль уже настроен. Чтобы заменить его, обновите Worker secret отдельно."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16);
const iterations = 100_000;
const derived = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const encoded = `pbkdf2$${iterations}$${salt.toString("hex")}$${derived.toString("hex")}`;
await mkdir(dirname(passwordFile), { recursive: true, mode: 0o700 });
await writeFile(passwordFile, `Админка базы отдыха «Золотая осень»\n\nАдрес: https://zolotayaosen.kz/admin/\nПароль: ${password}\n\nХраните этот файл приватно. Не добавляйте его в Git.\n`, { mode: 0o600, flag: "wx" });
await writeFile(hashFile, encoded + "\n", { mode: 0o600, flag: "wx" });
process.stdout.write("Пароль создан и сохранён в приватном файле .private/Золотая-осень-админ.txt.\n");
