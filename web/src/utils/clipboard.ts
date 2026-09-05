export async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    throw new Error('请求失败，请稍后重试');
  }
}
