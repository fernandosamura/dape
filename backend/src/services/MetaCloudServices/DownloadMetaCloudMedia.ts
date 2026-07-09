import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import axios from "axios";
import { extension as mimeExtension } from "mime-types";
import { logger } from "../../utils/logger";
import { uploadToR2 } from "../StorageServices/R2Service";

const fs = require("fs");
const writeFileAsync = promisify(writeFile);

const GRAPH_API_URL = "https://graph.facebook.com/v20.0";

interface MetaCloudMediaFile {
  mimetype: string;
  filename: string;
}

// Baixa uma midia recebida via Cloud API e salva no mesmo destino usado pelo
// fluxo Baileys (R2 se habilitado, senao public/ local) - so muda a origem
// do arquivo (API REST da Meta em vez do socket do Baileys). Retorna null em
// caso de erro, pra quem chama poder cair de volta num corpo textual
// placeholder sem quebrar o resto do processamento da mensagem.
export const downloadAndStoreMetaCloudMedia = async (
  mediaId: string,
  accessToken: string,
  originalFilename?: string
): Promise<MetaCloudMediaFile | null> => {
  try {
    // 1. Metadados da midia (URL de download temporaria + mime type)
    const metaResponse = await axios.get(`${GRAPH_API_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const { url, mime_type: mimetype } = metaResponse.data;
    if (!url || !mimetype) {
      logger.warn(`[MetaCloud] Metadados de midia incompletos para ${mediaId}`);
      return null;
    }

    // 2. Bytes do arquivo - a URL retornada acima tambem exige o mesmo Bearer
    // token (nao e publica), diferente de um link de CDN comum.
    const fileResponse = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer"
    });
    const fileBuffer = Buffer.from(fileResponse.data);

    let filename = originalFilename;
    if (!filename) {
      const ext = mimeExtension(mimetype) || "bin";
      filename = `${new Date().getTime()}.${ext}`;
    } else {
      filename = `${new Date().getTime()}_${filename}`;
    }

    if (process.env.CLOUDFLARE_R2_ENABLED === "true") {
      const tempPath = join(__dirname, "..", "..", "..", "public", "temp", filename);
      await writeFileAsync(tempPath, fileBuffer);
      await uploadToR2(tempPath, filename, mimetype);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } else {
      await writeFileAsync(
        join(__dirname, "..", "..", "..", "public", filename),
        fileBuffer
      );
    }

    return { mimetype, filename };
  } catch (err) {
    logger.error({ err }, `[MetaCloud] Erro ao baixar mídia ${mediaId}`);
    return null;
  }
};
