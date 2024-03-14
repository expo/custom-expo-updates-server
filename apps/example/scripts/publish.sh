source .env

while getopts d: flag
do
    case "${flag}" in
        d) directory=${OPTARG};;
    esac
done

expo export --experimental-bundle;
rm -rf $UPDATES_ASSET_PATH/$directory/
cp -r dist/ $UPDATES_ASSET_PATH/$directory

node ./scripts/exportClientExpoConfig.js > $UPDATES_ASSET_PATH/$directory/expoConfig.json;