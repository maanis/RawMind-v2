import path from "node:path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const DEFAULT_GRPC_SERVER = "grpc.nvcf.nvidia.com:443";
const DEFAULT_FUNCTION_ID = "b702f636-f60c-4a3d-a6f4-f3568c13bd7d";
const DEFAULT_MODEL = "whisper-large-v3";

function readEnv(name: string) {
  return (process.env[name] || "").trim().replace(/^["']|["']$/g, "");
}

function loadRivaProto() {
  const protoDir = path.join(process.cwd(), "src", "lib", "nvidia", "proto");
  const protoPath = path.join(protoDir, "riva_asr.proto");
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [protoDir],
  });

  const proto = grpc.loadPackageDefinition(packageDefinition) as {
    nvidia?: {
      riva?: {
        RivaSpeechRecognition?: new (
          address: string,
          credentials: grpc.ChannelCredentials
        ) => RivaSpeechRecognitionClient;
      };
    };
  };

  const Client = proto.nvidia?.riva?.RivaSpeechRecognition;
  if (!Client) {
    throw new Error("Unable to load NVIDIA Riva ASR gRPC client");
  }

  return Client;
}

function getNvidiaWhisperConfig() {
  const apiKey = readEnv("NVIDIA_API_KEY");
  const server = readEnv("NVIDIA_WHISPER_GRPC_SERVER") || DEFAULT_GRPC_SERVER;
  const functionId = readEnv("NVIDIA_WHISPER_FUNCTION_ID") || DEFAULT_FUNCTION_ID;
  const model = readEnv("NVIDIA_WHISPER_MODEL") || DEFAULT_MODEL;

  return {
    apiKey,
    server,
    functionId,
    model,
  };
}

type RecognizeRequest = {
  config: {
    encoding: "LINEAR_PCM";
    sampleRateHertz: number;
    languageCode: string;
    maxAlternatives?: number;
  };
  audio: Buffer;
  id?: {
    value: string;
  };
};

type RecognizeResponse = {
  results?: Array<{
    alternatives?: Array<{
      transcript?: string;
    }>;
  }>;
};

type RivaSpeechRecognitionClient = grpc.Client & {
  Recognize(
    request: RecognizeRequest,
    metadata: grpc.Metadata,
    callback: (error: grpc.ServiceError | null, response: RecognizeResponse) => void
  ): void;
};

export async function transcribeAudioWithNvidia(file: File, language = "en") {
  const { apiKey, server, functionId, model } = getNvidiaWhisperConfig();

  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is missing");
  }

  const arrayBuffer = await file.arrayBuffer();
  const audioBytes = Buffer.from(arrayBuffer);
  const Client = loadRivaProto();
  const client = new Client(server, grpc.credentials.createSsl());
  const metadata = new grpc.Metadata();

  metadata.add("authorization", `Bearer ${apiKey}`);
  metadata.add("function-id", functionId);

  try {
    const response = await new Promise<RecognizeResponse>((resolve, reject) => {
      client.Recognize(
        {
          config: {
            languageCode: language,
            model,
          } as RecognizeRequest["config"] & { model?: string },
          audio: audioBytes,
        } as RecognizeRequest & {
          config: RecognizeRequest["config"] & { model?: string };
        },
        metadata,
        (error, result) => {
          if (error) {
            reject(new Error(`${error.code ?? "unknown"} ${error.details || error.message || "NVIDIA transcription request failed"}`));
            return;
          }

          resolve(result);
        }
      );
    });

    const transcript = response.results
      ?.flatMap((result) => result.alternatives ?? [])
      .map((alternative) => alternative.transcript?.trim() ?? "")
      .find(Boolean);

    if (!transcript) {
      throw new Error("No transcript returned from NVIDIA");
    }

    return transcript;
  } finally {
    client.close();
  }
}
