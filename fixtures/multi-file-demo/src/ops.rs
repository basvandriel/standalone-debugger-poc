pub fn double(x: i32) -> i32 {
    x * 2
}

pub fn sum(values: &[i32]) -> i64 {
    let mut total: i64 = 0;
    for v in values {
        total += *v as i64;
    }
    total
}
