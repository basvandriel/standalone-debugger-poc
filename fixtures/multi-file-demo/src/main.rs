mod ops;
mod report;

fn main() {
    let mut values = vec![1, 2, 3, 4, 5];
    for v in values.iter_mut() {
        *v = ops::double(*v);
    }
    let total = ops::sum(&values);
    let summary = report::summarize(&values, total);
    println!("{summary}");
}
