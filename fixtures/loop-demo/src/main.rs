fn main() {
    let mut total: i64 = 0;
    let mut items: Vec<i32> = vec![1, 2, 3, 4, 5];
    for i in 0..items.len() {
        let doubled = double(items[i]);
        items[i] = doubled;
        total += doubled as i64;
        println!("iteration {i}: doubled={doubled} total={total}");
    }
    let summary = summarize(&items, total);
    println!("{summary}");
}

fn double(x: i32) -> i32 {
    x * 2
}

fn summarize(items: &[i32], total: i64) -> String {
    format!("items={items:?} total={total}")
}
