while getopts d: flag
do
    case "${flag}" in
        d) directory=${OPTARG};;
    esac
done

cd ../client
expo export --experimental-bundle
cd ../server
rm -rf ./updates/$directory/
cp -r ../client/dist/ ./updates/$directory

node ./scripts/exportClientExpoConfig.js > updates/$directory/expoConfig.json