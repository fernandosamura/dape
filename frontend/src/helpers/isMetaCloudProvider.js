// Espelha backend/src/helpers/isMetaCloudProvider.ts - ponto unico de
// verdade para "esta conexao usa a Cloud API da Meta, tradicional ou
// Coexistence" no frontend, evitando checagens de string espalhadas
// (`providerType === "meta_cloud"`) que ficariam desatualizadas toda vez
// que um novo modo de Cloud API for adicionado.
export const META_CLOUD_PROVIDER_TYPES = ["meta_cloud", "meta_cloud_coexistence"];

export const isMetaCloudProvider = (providerType) =>
  !!providerType && META_CLOUD_PROVIDER_TYPES.includes(providerType);
