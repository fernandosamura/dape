// Ponto unico de verdade para "esta conexao usa a Cloud API da Meta,
// tradicional ou Coexistence" - evita checagens de string espalhadas
// (`providerType === "meta_cloud"`) que precisariam ser lembradas
// manualmente toda vez que um novo modo de Cloud API for adicionado.
export const META_CLOUD_PROVIDER_TYPES = ["meta_cloud", "meta_cloud_coexistence"];

export const isMetaCloudProvider = (providerType?: string | null): boolean =>
  !!providerType && META_CLOUD_PROVIDER_TYPES.includes(providerType);
