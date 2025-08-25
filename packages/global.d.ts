/** 这里全局声明 一些变量*/

// 全局 compile-time 常数
declare var __VERSION__: string;
declare var __DEV__: boolean
declare var __TEST__: boolean
declare var __NODE_JS__: boolean
declare var __BROWSER__:boolean
declare var __GLOBAL__: boolean
declare var __ESM_BUNDLER__: boolean
declare var __ESM_BROWSER__: boolean
declare var __COMPAT__: boolean

// Feature flags
declare var __FEATURE_OPTIONS_API__: boolean;
declare var __FEATURE_PROD_DEVTOOLS__: boolean
declare var __FEATURE_SUSPENSE__: boolean
declare var __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: boolean


// For tests
declare namespace jest {
    interface Matchers<R, T> {
        toHaveBeenWarned(): R;

        toHaveBeenWarnedLast(): R;

        toHaveBeenWarnedTimes(n: number): R;
    }
}
