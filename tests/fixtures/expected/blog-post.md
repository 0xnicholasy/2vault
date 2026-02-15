By Jane Smith | March 15, 2025

Rust's ownership system is the language's most unique feature, and it enables Rust to make memory safety guarantees without needing a garbage collector. In this post, we'll explore how ownership works and why it matters.

## What is Ownership?

Ownership is a set of rules that govern how a Rust program manages memory. All programs have to manage the way they use a computer's memory while running. Some languages have garbage collection that regularly looks for no-longer-used memory as the program runs; in other languages, the programmer must explicitly allocate and free the memory.

Rust uses a third approach: memory is managed through a system of ownership with a set of rules that the compiler checks. If any of the rules are violated, the program won't compile.

## The Three Rules

There are three fundamental rules of ownership in Rust:

1.  Each value in Rust has an _owner_.
2.  There can only be one owner at a time.
3.  When the owner goes out of scope, the value will be dropped.

## Code Example

Here's a simple example demonstrating ownership transfer:

```
fn main() {
    let s1 = String::from("hello");
    let s2 = s1; // s1 is moved to s2

    // println!("{}", s1); // This would cause a compile error!
    println!("{}", s2); // This works fine
}
```

When we assign `s1` to `s2`, the `String` data is copied, meaning we copy the pointer, the length, and the capacity that are on the stack. We do not copy the data on the heap.

## Borrowing and References

What if we want to let a function use a value but not take ownership? Rust calls this _borrowing_, and it uses references to achieve it:

```
fn calculate_length(s: &String) -> usize {
    s.len()
}

fn main() {
    let s1 = String::from("hello");
    let len = calculate_length(&s1);
    println!("The length of '{}' is {}.", s1, len);
}
```

The `&s1` syntax lets us create a reference that _refers_ to the value of `s1` but does not own it. Because it does not own it, the value it points to will not be dropped when the reference stops being used.

## Conclusion

Rust's ownership model may seem restrictive at first, but it eliminates entire categories of bugs at compile time. No null pointer dereferences, no dangling pointers, no data races. Once you internalize the rules, you'll find that they guide you toward writing better, more efficient code.

In the next post, we'll dive into lifetimes and how they relate to ownership. Stay tuned!