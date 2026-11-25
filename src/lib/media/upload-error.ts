const connectionCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "ENETUNREACH", "EHOSTUNREACH"]);
const timeoutCodes = new Set(["ETIMEDOUT", "ESOCKETTIMEDOUT"]);
const certificateCodes = new Set(["CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID"]);

export function describeUploadFailure(error: unknown) {
  const detail = typeof error === "object" && error !== null ? error : {};
  const status = "http_code" in detail && typeof detail.http_code === "number" && detail.http_code >= 100 && detail.http_code <= 599
    ? detail.http_code : undefined;
  const suppliedCode = "code" in detail && typeof detail.code === "string" ? detail.code : "UNKNOWN";
  // Only known transport codes may enter logs. Provider messages can contain signed URLs and private paths.
  const code = connectionCodes.has(suppliedCode) || timeoutCodes.has(suppliedCode) || certificateCodes.has(suppliedCode)
    ? suppliedCode : "UNKNOWN";
  let message = "Upload failed. Please try again later.";
  if (timeoutCodes.has(code) || status === 408 || status === 499 || status === 504)
    message = "The upload timed out. Please try again.";
  else if (connectionCodes.has(code))
    message = "Could not connect to the upload service. Please try again.";
  else if (certificateCodes.has(code))
    message = "A secure connection to the upload service could not be established. Please contact an administrator.";
  else if (status === 401)
    message = "The upload service rejected authentication. Please contact an administrator.";
  else if (status === 403)
    message = "The upload service denied permission to upload this file. Please contact an administrator.";
  else if (status === 429)
    message = "The upload service is busy. Please wait a moment and try again.";
  return { status, code, message };
}
