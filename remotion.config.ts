import {Config} from '@remotion/cli/config';

Config.setEntryPoint('./remotion/index.ts');
Config.setOverwriteOutput(true);
Config.setVideoImageFormat('jpeg');
Config.setConcurrency(null);
Config.setChromiumDisableWebSecurity(true);
