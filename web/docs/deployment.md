# Web 部署

- 静态构建产物由 `pnpm build` 生成，可托管到 Nginx、CDN 或对象存储。
- `VITE_API_BASE_URL` 在构建时注入，指向目标 Cloud。
- 官方托管与私有化部署使用同一镜像，只替换构建参数。
