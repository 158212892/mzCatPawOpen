import * as esbuild from 'esbuild';
import fs from 'fs';
import { createHash } from 'crypto';
import {getWebsiteBundle} from "./esbuild-website.js";
import JavaScriptObfuscator from 'javascript-obfuscator';

const isDev = process.env.NODE_ENV === 'development'

let result = await esbuild.build({
    entryPoints: ['src/index.js'],
    outfile: 'dist/index.js',
    bundle: true,
    minify: true,
    write: true,
    metafile: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: isDev ? 'inline' : false,
    plugins: isDev ? [genMd5()] : [obfuscator(), addWebsite(), genMd5()],
});

fs.writeFileSync('meta.server.json', JSON.stringify(result.metafile))

function addWebsite() {
    return {
        name: 'add-website',
        setup(build) {
            build.onEnd(async (_) => {
                const filePath = 'dist/index.js';
                const serverContent = fs.readFileSync(filePath, 'utf8');
                const websiteContent = await getWebsiteBundle();

                fs.writeFileSync(filePath, websiteContent + serverContent);
            });
        },
    };
}

function genMd5() {
    return {
        name: 'gen-output-file-md5',
        setup(build) {
            build.onEnd(async (_) => {
                const md5 = createHash('md5').update(fs.readFileSync('dist/index.js')).digest('hex');
                fs.writeFileSync('dist/index.js.md5', md5);
            });
        },
    };
}

function obfuscator() {
    return {
        name: 'obfuscator',
        setup(build) {
            build.onLoad({ filter: /\.js$/ }, async (args) => {
                const contents = fs.readFileSync(args.path, 'utf8');
                if (contents.startsWith('//jiami-mark')) {
                    const obfuscationResult = JavaScriptObfuscator.obfuscate(contents,
                      {
                          compact: false,
                          controlFlowFlattening: true,
                          controlFlowFlatteningThreshold: 1,
                          numbersToExpressions: true,
                          simplify: true,
                          stringArrayShuffle: true,
                          splitStrings: true,
                          stringArrayThreshold: 1
                      }
                    );
                    return {
                        contents: obfuscationResult.getObfuscatedCode(),
                        loader: 'js'
                    };
                }
                return {
                    contents,
                    loader: 'js'
                };
            });
        }
    }
};