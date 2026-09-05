// 用例：设备注册与凭证持久化。
// 首次连接使用一次性部署令牌，成功后换取设备凭证。
export interface RegistrationService {
  isRegistered(): Promise<boolean>;
  register(token: string): Promise<void>;
}
