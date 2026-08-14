import { Container } from "@cloudflare/containers";

type FileProcessorContainerEnvironment = {
  FILE_PROCESSOR_SHARED_SECRET?: string;
};

function sharedSecret(value: string | undefined) {
  if (!value || new TextEncoder().encode(value).byteLength < 32) {
    throw new Error("FILE_PROCESSOR_SHARED_SECRET is required");
  }
  return value;
}

export class FileProcessorContainer extends Container<FileProcessorContainerEnvironment> {
  defaultPort = 8080;
  enableInternet = false;
  pingEndpoint = "localhost/health/ready";
  sleepAfter = "10m";
  envVars: Record<string, string>;

  constructor(
    context: ConstructorParameters<
      typeof Container<FileProcessorContainerEnvironment>
    >[0],
    containerEnv: FileProcessorContainerEnvironment,
  ) {
    super(context, containerEnv);
    this.envVars = {
      FILE_PROCESSOR_SHARED_SECRET: sharedSecret(
        containerEnv.FILE_PROCESSOR_SHARED_SECRET,
      ),
    };
  }
}
