import { cleanTestData, loadEnv } from "./safety";

export default async function globalSetup() {
  loadEnv();
  await cleanTestData();
}
