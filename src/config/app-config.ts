import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "OPTICOLOR - BI",
  version: packageJson.version,
  copyright: `© ${currentYear}, Opticolor - BI.`,
  meta: {
    title: "OPTICOLOR - BI",
    description:
      "OPTICOLOR - BI panel administrativo.",
  },
};
