import { createFixedAdapterFixtures } from "../packages/adapter-sdk/dist/index.js";

const [adapter] = createFixedAdapterFixtures();
const result = await adapter.run({
  invocationId: "quickstart-1",
  input: { text: "hello mojing" },
  grantedPermissions: ["fixture.text.read"],
  signal: new AbortController().signal,
  resumeFrom: null,
});

if (result.status !== "completed" || result.formalWrite !== false)
  throw new Error("MINIMAL_ADAPTER_EXAMPLE_FAILED");

console.log(
  JSON.stringify({ descriptor: adapter.discover(), result }, null, 2),
);
