import { cleanTestData } from "./safety";

export default async function globalTeardown() {
  await cleanTestData();
}
