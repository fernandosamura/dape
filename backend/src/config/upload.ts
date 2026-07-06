import path from "path";
import multer from "multer";
import fs from "fs";

const publicFolder = path.resolve(__dirname, "..", "..", "public");
const tempFolder = path.resolve(publicFolder, "temp");

export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: async function (req, file, cb) {
      // Quando R2 está ativo, todos os uploads vão para public/temp (staging)
      if (process.env.CLOUDFLARE_R2_ENABLED === "true") {
        if (!fs.existsSync(tempFolder)) {
          fs.mkdirSync(tempFolder, { recursive: true });
          fs.chmodSync(tempFolder, 0o777);
        }
        return cb(null, tempFolder);
      }

      const { typeArch, fileId } = req.body;
      let folder: string;

      if (typeArch && typeArch !== "announcements") {
        folder = path.resolve(publicFolder, typeArch, fileId ? fileId : "");
      } else if (typeArch && typeArch === "announcements") {
        folder = path.resolve(publicFolder, typeArch);
      } else {
        folder = path.resolve(publicFolder);
      }

      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        fs.chmodSync(folder, 0o777);
      }
      return cb(null, folder);
    },
    filename(req, file, cb) {
      const { typeArch } = req.body;

      // Sanitiza o nome original mantendo apenas alfanuméricos, pontos e hífens
      const sanitizedName = file.originalname
        .normalize("NFD")
        .replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // Remove acentos
        .replace(/[^a-zA-Z0-9.-]/g, "_"); // Substitui caracteres especiais por _

      const fileName =
        typeArch && typeArch !== "announcements"
          ? sanitizedName
          : `${new Date().getTime()}_${sanitizedName}`;

      return cb(null, fileName);
    }
  })
};
