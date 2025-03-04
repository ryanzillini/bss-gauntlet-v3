
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>BSS Magic</title>
        <meta name="description" content="BSS Magic - Totogi" />
      </Head>
      <Toaster position="top-right" />
      <Component {...pageProps} />
    </>
  );
} 