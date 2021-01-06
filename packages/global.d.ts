/** 这里全局声明 一些变量*/

// 全局 compile-time 常数
declare var __VERSION__: string;
declare var __DEV__: boolean

// Feature flags
declare var __FEATURE_OPTIONS_API__: boolean;
declare var __FEATURE_PROD_DEVTOOLS__:boolean

// For tests
declare namespace jest {
    interface Matchers<R, T> {
        toHaveBeenWarned(): R;

        toHaveBeenWarnedLast(): R;

        toHaveBeenWarnedTimes(n: number): R;
    }
}
