export type AddressSearchEnv = {
  ADDRESS_SEARCH_API_KEY?: string;
  JUSO_API_KEY?: string;
  ADDRESS_SEARCH_API_URL?: string;
};

type JusoAddressRow = {
  roadAddr?: string;
  jibunAddr?: string;
  zipNo?: string;
  bdNm?: string;
  admCd?: string;
  rnMgtSn?: string;
  udrtYn?: string;
  buldMnnm?: string;
  buldSlno?: string;
};

type JusoApiResponse = {
  results?: {
    common?: {
      errorCode?: string;
      errorMessage?: string;
      totalCount?: string;
    };
    juso?: JusoAddressRow[];
  };
};

export type OperationalAddressSearchResult = {
  id: string;
  postalCode: string;
  roadAddress: string;
  jibunAddress: string | null;
  buildingName: string | null;
};

export type OperationalAddressSearchServiceResult =
  | { ok: true; keyword: string; results: OperationalAddressSearchResult[]; provider: "juso" }
  | { ok: false; error: "EXTERNAL_ADDRESS_NOT_CONFIGURED" | "VALIDATION_ERROR" | "PROVIDER_ERROR"; message: string };

function getAddressSearchApiKey(env: AddressSearchEnv) {
  return env.ADDRESS_SEARCH_API_KEY?.trim() || env.JUSO_API_KEY?.trim() || "";
}

function buildJusoResultId(row: JusoAddressRow, index: number) {
  return [row.admCd, row.rnMgtSn, row.udrtYn, row.buldMnnm, row.buldSlno, row.zipNo, index]
    .filter(Boolean)
    .join(":");
}

export async function searchOperationalAddresses(
  env: AddressSearchEnv,
  keyword: string,
  options: { fetch?: typeof fetch; countPerPage?: number } = {},
): Promise<OperationalAddressSearchServiceResult> {
  const trimmedKeyword = keyword.trim();
  if (trimmedKeyword.length < 2) {
    return { ok: false, error: "VALIDATION_ERROR", message: "주소 검색어는 2글자 이상 입력해야 합니다." };
  }

  const apiKey = getAddressSearchApiKey(env);
  if (!apiKey) {
    return {
      ok: false,
      error: "EXTERNAL_ADDRESS_NOT_CONFIGURED",
      message: "주소검색 외부 API 키가 설정되지 않았습니다.",
    };
  }

  const endpoint = env.ADDRESS_SEARCH_API_URL?.trim() || "https://business.juso.go.kr/addrlink/addrLinkApi.do";
  const url = new URL(endpoint);
  url.searchParams.set("confmKey", apiKey);
  url.searchParams.set("currentPage", "1");
  url.searchParams.set("countPerPage", String(options.countPerPage ?? 10));
  url.searchParams.set("keyword", trimmedKeyword);
  url.searchParams.set("resultType", "json");

  const fetcher = options.fetch ?? fetch;
  const response = await fetcher(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) {
    return { ok: false, error: "PROVIDER_ERROR", message: "주소검색 제공자 응답을 받지 못했습니다." };
  }

  const payload = (await response.json().catch(() => null)) as JusoApiResponse | null;
  const common = payload?.results?.common;
  if (!payload || !common) {
    return { ok: false, error: "PROVIDER_ERROR", message: "주소검색 제공자 응답 형식이 올바르지 않습니다." };
  }
  if (common.errorCode && common.errorCode !== "0") {
    return {
      ok: false,
      error: common.errorCode === "E0005" ? "VALIDATION_ERROR" : "PROVIDER_ERROR",
      message: common.errorMessage || "주소검색 제공자 오류가 발생했습니다.",
    };
  }

  const rows = payload.results?.juso ?? [];
  return {
    ok: true,
    keyword: trimmedKeyword,
    provider: "juso",
    results: rows
      .filter((row) => row.roadAddr && row.zipNo)
      .map((row, index) => ({
        id: buildJusoResultId(row, index),
        postalCode: row.zipNo ?? "",
        roadAddress: row.roadAddr ?? "",
        jibunAddress: row.jibunAddr || null,
        buildingName: row.bdNm || null,
      })),
  };
}
