import CoreGraphics
import Foundation

struct WindowInfo: Encodable {
    let id: Int
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

guard CommandLine.arguments.count >= 3 else {
    fputs("Usage: find-window.swift <owner> <title>\n", stderr)
    exit(2)
}

let ownerName = CommandLine.arguments[1]
let windowTitle = CommandLine.arguments[2]

let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []

let matchedWindow = windows.first { item in
    let owner = item[kCGWindowOwnerName as String] as? String ?? ""
    let title = item[kCGWindowName as String] as? String ?? ""
    let layer = item[kCGWindowLayer as String] as? Int ?? -1
    return owner == ownerName && title == windowTitle && layer == 0
}

guard
    let window = matchedWindow,
    let id = window[kCGWindowNumber as String] as? Int,
    let bounds = window[kCGWindowBounds as String] as? [String: Any],
    let x = bounds["X"] as? Double,
    let y = bounds["Y"] as? Double,
    let width = bounds["Width"] as? Double,
    let height = bounds["Height"] as? Double
else {
    exit(1)
}

let payload = WindowInfo(id: id, x: x, y: y, width: width, height: height)
let data = try JSONEncoder().encode(payload)
FileHandle.standardOutput.write(data)
