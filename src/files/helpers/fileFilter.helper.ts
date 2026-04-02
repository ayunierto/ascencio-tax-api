export const FileFilter = (
  req: Express.Request,
  file: Express.Multer.File | undefined,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  void req;
  if (!file) {
    callback(new Error('File is empty'), false);
    return;
  }

  const fileExtension = file.mimetype.split('/')[1];
  const validExtensions = ['jpg', 'jpeg', 'png', 'gif'];

  if (validExtensions.includes(fileExtension)) {
    callback(null, true);
    return;
  }

  callback(null, false);
};
