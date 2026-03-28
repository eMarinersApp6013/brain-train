function adminAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function portalAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { adminAuth, portalAuth };
