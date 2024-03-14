while getopts d: flag
do
    case "${flag}" in
        d) directory=${OPTARG};;
    esac
done

expo export --experimental-bundle;
rm -rf ./.updates/$directory/
cp -r dist/ ./updates/$directory

node ./scripts/exportClientExpoConfig.js > ./updates/$directory/expoConfig.json;