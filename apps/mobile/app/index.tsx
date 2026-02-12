import { useState, useRef, useCallback } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Pressable,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { ArrowUp } from "lucide-react-native";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const INPUT_MAX_HEIGHT = 120;
const SINGLE_LINE_HEIGHT = 20; // approximate single line content height

const MOCK_MESSAGES = [
  { id: "1", role: "user", content: "Hello, can you help me with a task?" },
  {
    id: "2",
    role: "assistant",
    content:
      "Of course! I'd be happy to help. What would you like me to do?",
  },
  { id: "3", role: "user", content: "Explain how WebSockets work." },
  {
    id: "4",
    role: "assistant",
    content:
      "WebSockets provide full-duplex communication channels over a single TCP connection. Unlike HTTP, which is request-response based, WebSockets allow both the client and server to send messages independently at any time.\n\nThe connection starts as a standard HTTP request, then upgrades to a persistent WebSocket connection via a handshake.",
  },
];

export default function Index() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [contentHeight, setContentHeight] = useState(SINGLE_LINE_HEIGHT);
  const scrollRef = useRef<ScrollView>(null);

  const isMultiline = contentHeight > SINGLE_LINE_HEIGHT + 4;

  const handleContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      const newHeight = e.nativeEvent.contentSize.height;
      if (newHeight !== contentHeight) {
        LayoutAnimation.configureNext(
          LayoutAnimation.create(150, "easeInEaseOut", "opacity")
        );
        setContentHeight(newHeight);
      }
    },
    [contentHeight]
  );

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), role: "user", content: trimmed },
    ]);
    setInput("");
    LayoutAnimation.configureNext(
      LayoutAnimation.create(150, "easeInEaseOut", "opacity")
    );
    setContentHeight(SINGLE_LINE_HEIGHT);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  const canSend = input.trim().length > 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View className="px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Multica</Text>
          <Text className="text-xs text-muted-foreground">Agent connected</Text>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="px-4 py-2 gap-5"
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg) =>
            msg.role === "user" ? (
              <View key={msg.id} className="flex-row justify-end">
                <View className="max-w-[80%] rounded-2xl rounded-br-sm bg-muted px-4 py-2.5">
                  <Text className="text-[15px] leading-[22px] text-foreground">
                    {msg.content}
                  </Text>
                </View>
              </View>
            ) : (
              <View key={msg.id}>
                <Text className="text-[15px] leading-[22px] text-foreground">
                  {msg.content}
                </Text>
              </View>
            )
          )}
        </ScrollView>

        {/* Input bar */}
        <View className="px-3 pb-1 pt-2">
          <View
            className={`flex-row border border-border bg-card pl-4 pr-1.5 py-1.5 ${
              isMultiline ? "items-end rounded-2xl" : "items-center rounded-full"
            }`}
          >
            <TextInput
              className="flex-1 border-0 bg-transparent text-[15px] leading-5 text-foreground"
              placeholder="Type a message..."
              placeholderTextColor="hsl(240.1, 4.4%, 46.3%)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              onContentSizeChange={handleContentSizeChange}
              multiline
              scrollEnabled={contentHeight >= INPUT_MAX_HEIGHT}
              textAlignVertical="top"
              selectionColor="hsl(243.5, 75.2%, 58.5%)"
              underlineColorAndroid="transparent"
              style={{
                maxHeight: INPUT_MAX_HEIGHT,
                paddingTop: 0,
                paddingBottom: 0,
                // @ts-ignore web-only: remove browser default outline/border
                outline: "none",
                borderWidth: 0,
                boxShadow: "none",
              }}
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              className="ml-1.5 h-8 w-8 items-center justify-center rounded-full bg-primary"
              style={{ opacity: canSend ? 1 : 0.5 }}
            >
              <ArrowUp
                size={18}
                color="hsl(225, 100%, 96.4%)"
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
