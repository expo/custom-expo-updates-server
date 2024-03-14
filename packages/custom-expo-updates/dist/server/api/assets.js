"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var mime_1 = __importDefault(require("mime"));
var nullthrows_1 = __importDefault(require("nullthrows"));
var path_1 = __importDefault(require("path"));
var helpers_1 = require("../common/helpers");
function assetsEndpoint(req, res, next) {
    if (next === void 0) { next = function () { }; }
    return __awaiter(this, void 0, void 0, function () {
        var _a, assetName, runtimeVersion, platform, updateBundlePath, error_1, metadataJson, assetPath, assetMetadata, isLaunchAsset, asset;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = req.query, assetName = _a.asset, runtimeVersion = _a.runtimeVersion, platform = _a.platform;
                    if (!assetName || typeof assetName !== 'string') {
                        res.statusCode = 400;
                        res.json({ error: 'No asset name provided.' });
                        return [2 /*return*/];
                    }
                    if (platform !== 'ios' && platform !== 'android') {
                        res.statusCode = 400;
                        res.json({ error: 'No platform provided. Expected "ios" or "android".' });
                        return [2 /*return*/];
                    }
                    if (!runtimeVersion || typeof runtimeVersion !== 'string') {
                        res.statusCode = 400;
                        res.json({ error: 'No runtimeVersion provided.' });
                        return [2 /*return*/];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, helpers_1.getLatestUpdateBundlePathForRuntimeVersionAsync)(runtimeVersion)];
                case 2:
                    updateBundlePath = _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _b.sent();
                    res.statusCode = 404;
                    res.json({
                        error: error_1.message,
                    });
                    return [2 /*return*/];
                case 4: return [4 /*yield*/, (0, helpers_1.getMetadataAsync)({
                        updateBundlePath: updateBundlePath,
                        runtimeVersion: runtimeVersion,
                    })];
                case 5:
                    metadataJson = (_b.sent()).metadataJson;
                    assetPath = path_1.default.resolve(assetName);
                    assetMetadata = metadataJson.fileMetadata[platform].assets.find(function (asset) { return asset.path === assetName.replace("".concat(updateBundlePath, "/"), ''); });
                    isLaunchAsset = metadataJson.fileMetadata[platform].bundle === assetName.replace("".concat(updateBundlePath, "/"), '');
                    if (!fs_1.default.existsSync(assetPath)) {
                        res.statusCode = 404;
                        res.json({ error: "Asset \"".concat(assetName, "\" does not exist.") });
                        return [2 /*return*/];
                    }
                    try {
                        asset = fs_1.default.readFileSync(assetPath, null);
                        res.statusCode = 200;
                        res.setHeader('content-type', isLaunchAsset ? 'application/javascript' : (0, nullthrows_1.default)(mime_1.default.getType(assetMetadata.ext)));
                        res.end(asset);
                    }
                    catch (error) {
                        res.statusCode = 500;
                        res.json({ error: error });
                    }
                    return [2 /*return*/];
            }
        });
    });
}
exports.default = assetsEndpoint;
