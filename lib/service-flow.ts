export function requiredCitizenUploads(documentCount: number): number {
  return Math.max(0, documentCount - 1);
}

export function canSubmitGenericService(input: {
  detail: string;
  documentCount: number;
  uploadedCount: number;
  consent: boolean;
}): boolean {
  return (
    input.detail.trim().length > 0 &&
    input.uploadedCount >= requiredCitizenUploads(input.documentCount) &&
    input.consent
  );
}
