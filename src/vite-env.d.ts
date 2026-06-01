/// <reference types="vite/client" />

// Variables d'environnement de build (Vite). Les coordonnées de paiement sont
// optionnelles : une méthode non renseignée n'apparaît tout simplement pas
// dans la modale (cf. PaymentModal). À définir dans .env / le build Cloud Run.
interface ImportMetaEnv {
  readonly VITE_WERO_NUMBER?: string;
  readonly VITE_BTC_ADDRESS?: string;
  readonly VITE_ETH_ADDRESS?: string;
  readonly VITE_SOL_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
