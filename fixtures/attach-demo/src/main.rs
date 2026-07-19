use std::thread::sleep;
use std::time::Duration;

// Deliberately slow (one tick/second) -- this fixture is meant to be started
// by hand from a second terminal *after* `dbg attach --name attach-demo` is
// already armed and watching, so there's a comfortable, visible window to
// see it get caught.
fn main() {
    let mut count = 0;
    for _ in 0..5 {
        count = tick(count);
        println!("tick {count}");
        sleep(Duration::from_secs(1));
    }
    println!("done, final count={count}");
}

fn tick(count: i32) -> i32 {
    count + 1
}
