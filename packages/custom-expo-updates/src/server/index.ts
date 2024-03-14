import { Request, Response, NextFunction } from 'express';

import manifestEndpoint from './api/manifest';
import assetsEndpoint from './api/assets';

const UpdatesMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/assets')) {
    return assetsEndpoint(req, res, next);
  } else if (req.path.startsWith('/api/manifest')) {
    const resp = manifestEndpoint(req, res, next);
    return resp;
  } else {
    next();
  }
};

module.exports = UpdatesMiddleware;
module.exports.UpdatesMiddleware = UpdatesMiddleware;