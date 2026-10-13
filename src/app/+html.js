import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Việc Nhanh — Việc lặt vặt quanh bạn</title>
        <meta
          name="description"
          content="Kết nối người cần việc với thợ gần nhà: dọn dẹp, sửa chữa, giao hàng và hơn 15 nhóm việc."
        />
        <meta property="og:title" content="Việc Nhanh" />
        <meta
          property="og:description"
          content="Đăng việc 30 giây, thợ gần nhà báo giá, thuê và hoàn thành."
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
