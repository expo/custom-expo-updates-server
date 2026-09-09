import Head from 'next/head';
import Link from 'next/link';

import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Custom Expo Updates Server</title>
        <meta name="description" content="Local Expo SDK 57 custom updates protocol server" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <p className={styles.eyebrow}>LOCAL PROTOCOL SERVER</p>
        <h1 className={styles.title}>Expo Updates SDK 57</h1>

        <p className={styles.description}>
          The server is running. Publish an update, then use a release build of the diagnostic app
          to check, fetch, and reload it.
        </p>

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2>Manifest endpoint</h2>
            <code>/api/manifest</code>
            <p>Protocols 1 and 0, signing, channels, cohorts, and directives.</p>
          </section>

          <section className={styles.card}>
            <h2>Asset endpoint</h2>
            <code>/api/assets</code>
            <p>Immutable assets, ETags, compression, and validated BSDIFF40 deltas.</p>
          </section>

          <section className={styles.card}>
            <h2>Runtime</h2>
            <code>57</code>
            <p>Expo and expo-updates 57.0.21 with React Native 0.86.3.</p>
          </section>

          <section className={styles.card}>
            <h2>Artifact view</h2>
            <code>/artifacts</code>
            <p>
              <Link href="/artifacts">
                Inspect channel state, bundle sizes, patches, and rollbacks.
              </Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
