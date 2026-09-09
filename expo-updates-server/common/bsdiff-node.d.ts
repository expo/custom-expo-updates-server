declare module 'bsdiff-node' {
  type ProgressCallback = (progress: number, error?: Error) => void;

  const bsdiff: {
    diff(
      oldFile: string,
      newFile: string,
      patchFile: string,
      callback?: ProgressCallback,
    ): Promise<void>;
    diffSync(oldFile: string, newFile: string, patchFile: string): void;
    patch(
      oldFile: string,
      newFile: string,
      patchFile: string,
      callback?: ProgressCallback,
    ): Promise<void>;
    patchSync(oldFile: string, newFile: string, patchFile: string): void;
  };

  export default bsdiff;
}
