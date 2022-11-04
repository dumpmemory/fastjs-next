import fastjsDom from "./fastjsDom";

export default (_e: fastjsDom) => {
    return {
        get(key: string | number): any {
            return _e._el[key];
        },
        set(key: string | number, val: any): fastjsDom {
            _e._el[key] = val;
            return _e;
        }
    }
}