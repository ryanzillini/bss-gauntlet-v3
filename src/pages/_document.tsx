import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/png" href="/images/Totogi-avatar-digital-effect.png" />
        <link rel="apple-touch-icon" href="/images/Totogi-avatar-digital-effect.png" />
        <link rel="shortcut icon" type="image/png" href="/images/Totogi-avatar-digital-effect.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
} 