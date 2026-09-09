import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Head from 'next/head';

import { artifactViewEnabled, getArtifactReportAsync } from '../common/artifacts';
import styles from '../styles/Artifacts.module.css';

type ArtifactReport = Awaited<ReturnType<typeof getArtifactReportAsync>>;
type ArtifactsProps = { report: ArtifactReport };

export const getServerSideProps: GetServerSideProps<ArtifactsProps> = async () => {
  if (!artifactViewEnabled()) {
    return { notFound: true };
  }
  return { props: { report: await getArtifactReportAsync() } };
};

export default function Artifacts({
  report,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <main className={styles.main}>
      <Head>
        <title>Expo update artifacts</title>
      </Head>
      <p className={styles.eyebrow}>LOCAL ARTIFACT VIEW</p>
      <h1>Update delivery state</h1>
      <ol className={styles.operations}>
        {report.operations.map((operation: string) => (
          <li key={operation}>{operation}</li>
        ))}
      </ol>
      <div className={styles.grid}>
        {report.artifacts.map((artifact) => (
          <article
            className={styles.card}
            key={`${artifact.directory}:${artifact.updateId ?? artifact.groupId}`}>
            <header>
              <span>{artifact.operation}</span>
              <strong>{artifact.state}</strong>
            </header>
            <dl>
              <dt>runtime</dt>
              <dd>{artifact.runtimeVersion}</dd>
              <dt>channel</dt>
              <dd>{artifact.channel ?? 'unscoped'}</dd>
              <dt>platform</dt>
              <dd>{artifact.platform}</dd>
              <dt>update</dt>
              <dd>{artifact.updateId ?? 'embedded rollback'}</dd>
              <dt>created</dt>
              <dd>{artifact.createdAt}</dd>
            </dl>
            {Object.entries(artifact.platforms).map(([platform, details]) => (
              <section key={platform} className={styles.platform}>
                <h2>{platform}</h2>
                <p>
                  {details.launchAssetBytes.toLocaleString()} byte launch asset ·{' '}
                  {details.assetCount} static assets
                </p>
                {details.patches.map((patch) => (
                  <p key={patch.baseUpdateId} className={styles.patch}>
                    bsdiff from {patch.baseUpdateId}: {patch.bytes.toLocaleString()} bytes (
                    {patch.savingsPercent}% saved)
                  </p>
                ))}
              </section>
            ))}
          </article>
        ))}
      </div>
    </main>
  );
}
